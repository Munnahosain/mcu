import React, { useEffect, useState, useRef } from 'react';
import { DesignElement, PatternSettings } from '../types';
import { drawTileToCanvas } from '../utils/exportUtils';
import { Shirt, ShoppingBag, Bed, Sparkles, Layers, Sliders, Download, Loader2 } from 'lucide-react';

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
  const [isExporting, setIsExporting] = useState(false);
  const mockupContainerRef = useRef<HTMLDivElement>(null);

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

  const handleExportMockup = () => {
    if (!mockupContainerRef.current) return;
    setIsExporting(true);
    try {
      const svgElement = mockupContainerRef.current.querySelector('svg');
      if (!svgElement) {
        setIsExporting(false);
        return;
      }

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 1200;
        const context = canvas.getContext('2d');
        if (context) {
          // Fill rich dark studio background
          context.fillStyle = '#101116';
          context.fillRect(0, 0, canvas.width, canvas.height);

          // Subtle ambient glow
          const radial = context.createRadialGradient(600, 600, 100, 600, 600, 500);
          radial.addColorStop(0, 'rgba(24, 201, 138, 0.08)');
          radial.addColorStop(1, 'rgba(16, 17, 22, 0)');
          context.fillStyle = radial;
          context.fillRect(0, 0, canvas.width, canvas.height);

          // Draw product centered
          const scale = Math.min((canvas.width * 0.8) / image.width, (canvas.height * 0.8) / image.height);
          const drawW = image.width * scale;
          const drawH = image.height * scale;
          const drawX = (canvas.width - drawW) / 2;
          const drawY = (canvas.height - drawH) / 2;
          context.drawImage(image, drawX, drawY, drawW, drawH);

          canvas.toBlob((blob) => {
            if (blob) {
              const dlUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = dlUrl;
              a.download = `product-mockup-${activeProduct}-${Date.now()}.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(dlUrl);
            }
            setIsExporting(false);
          }, 'image/png');
        } else {
          setIsExporting(false);
        }
        URL.revokeObjectURL(blobURL);
      };
      image.onerror = () => {
        setIsExporting(false);
        URL.revokeObjectURL(blobURL);
      };
      image.src = blobURL;
    } catch (err) {
      console.error('Mockup export error:', err);
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background select-none p-4 sm:p-6 text-foreground flex flex-col">
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col space-y-4">
        {/* Mockup Toolbar */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
          {/* Product Selectors */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-[var(--input-bg)] rounded-xl border border-[var(--card-border)]">
            {productTabs.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveProduct(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeProduct === p.id
                      ? 'bg-primary text-background shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">{p.name}</span>
                </button>
              );
            })}
          </div>

          {/* Scale Slider & Export Button */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2.5 bg-[var(--input-bg)] px-3 py-1.5 rounded-xl border border-[var(--card-border)] text-xs">
              <Sliders className="w-3.5 h-3.5 text-primary" />
              <span className="text-[var(--text-secondary)] font-bold">Scale:</span>
              <input
                type="range"
                min="0.5"
                max="2.2"
                step="0.1"
                value={patternScale}
                onChange={(e) => setPatternScale(Number(e.target.value))}
                className="w-24 accent-primary cursor-pointer"
              />
              <span className="font-mono text-primary text-[11px] font-bold w-7">
                {patternScale}x
              </span>
            </div>

            <button
              onClick={handleExportMockup}
              disabled={isExporting || !tileDataUrl}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-background font-bold text-xs hover:bg-primary/90 disabled:opacity-40 transition shadow-sm"
              title="Download client-ready product preview image"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Download Mockup (PNG)</span>
            </button>
          </div>
        </div>

        {/* 3D / Apparel Stage View */}
        <div className="flex-1 min-h-[460px] bg-gradient-to-b from-[var(--card-bg)] to-[var(--input-bg)] border border-[var(--card-border)] rounded-3xl flex items-center justify-center p-8 relative overflow-hidden shadow-2xl">
          {/* Subtle Ambient Backlight */}
          <div className="absolute w-96 h-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

          {/* Mockup SVG Visualizers */}
          {tileDataUrl && (
            <div ref={mockupContainerRef} className="relative w-full max-w-md h-[460px] flex items-center justify-center">
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
                      <image href={tileDataUrl} xlinkHref={tileDataUrl} width={tileSize} height={tileSize} />
                    </pattern>
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
                    <path
                      d="M170,25 Q200,45 230,25 L280,60 L240,110 L250,190 L340,460 L60,460 L150,190 L160,110 L120,60 Z"
                      fill="url(#pattern-dress)"
                      stroke="#44403c"
                      strokeWidth="2"
                    />
                    <path
                      d="M170,25 Q200,45 230,25 L280,60 L240,110 L250,190 L340,460 L60,460 L150,190 L160,110 L120,60 Z"
                      fill="url(#dress-shadow)"
                      style={{ mixBlendMode: 'multiply' }}
                    />
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
                      <image href={tileDataUrl} xlinkHref={tileDataUrl} width={tileSize} height={tileSize} />
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
                      <image href={tileDataUrl} xlinkHref={tileDataUrl} width={tileSize} height={tileSize} />
                    </pattern>
                    <radialGradient id="silk-sheen" cx="45%" cy="45%" r="60%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
                      <stop offset="70%" stopColor="#000000" stopOpacity="0.05" />
                      <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
                    </radialGradient>
                  </defs>
                  <g transform="rotate(4 220 220)">
                    <rect
                      x="40"
                      y="40"
                      width="360"
                      height="360"
                      rx="4"
                      fill="url(#pattern-scarf)"
                      stroke="#d6d3d1"
                      strokeWidth="3"
                    />
                    <rect
                      x="40"
                      y="40"
                      width="360"
                      height="360"
                      rx="4"
                      fill="url(#silk-sheen)"
                      style={{ mixBlendMode: 'overlay' }}
                    />
                    <rect
                      x="48"
                      y="48"
                      width="344"
                      height="344"
                      rx="2"
                      fill="none"
                      stroke="#18c98a"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                      opacity="0.75"
                    />
                  </g>
                </svg>
              )}

              {/* Product: Throw Cushion */}
              {activeProduct === 'pillow' && (
                <svg
                  viewBox="0 0 420 420"
                  className="w-full h-full drop-shadow-[0_25px_40px_rgba(0,0,0,0.85)]"
                >
                  <defs>
                    <pattern
                      id="pattern-pillow"
                      width={tileSize}
                      height={tileSize}
                      patternUnits="userSpaceOnUse"
                    >
                      <image href={tileDataUrl} xlinkHref={tileDataUrl} width={tileSize} height={tileSize} />
                    </pattern>
                    <radialGradient id="pillow-bulge" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#fff" stopOpacity="0.25" />
                      <stop offset="50%" stopColor="#000" stopOpacity="0.05" />
                      <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
                    </radialGradient>
                  </defs>
                  <g>
                    <path
                      d="M60,60 Q210,40 360,60 Q380,210 360,360 Q210,380 60,360 Q40,210 60,60 Z"
                      fill="url(#pattern-pillow)"
                      stroke="#57534e"
                      strokeWidth="3"
                    />
                    <path
                      d="M60,60 Q210,40 360,60 Q380,210 360,360 Q210,380 60,360 Q40,210 60,60 Z"
                      fill="url(#pillow-bulge)"
                      style={{ mixBlendMode: 'multiply' }}
                    />
                    {/* Seam piping border */}
                    <path
                      d="M60,60 Q210,40 360,60 Q380,210 360,360 Q210,380 60,360 Q40,210 60,60 Z"
                      fill="none"
                      stroke="#292524"
                      strokeWidth="1.5"
                    />
                  </g>
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
                      <image href={tileDataUrl} xlinkHref={tileDataUrl} width={tileSize} height={tileSize} />
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
          <div className="absolute bottom-4 left-6 bg-[var(--input-bg)]/90 backdrop-blur px-3 py-1.5 rounded-xl border border-[var(--card-border)] text-xs flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="font-bold text-foreground capitalize">
              {activeProduct.replace('-', ' ')}
            </span>
            <span className="text-[var(--text-muted)]">|</span>
            <span className="text-[var(--text-secondary)] font-mono">
              Tile: {settings.physicalSize} {settings.physicalUnit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
