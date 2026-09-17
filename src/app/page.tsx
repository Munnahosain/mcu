"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Box,
  CalendarDays,
  Check,
  Eraser,
  Grid3X3,
  ImagePlus,
  Layers3,
  Palette,
  Sparkles,
  TerminalSquare,
  Type,
  WandSparkles,
  Zap,
} from "lucide-react";
import MarketingChrome from "@/components/MarketingChrome";

const workflow = [
  { step: "01", title: "Connect your models", text: "Save Groq, Gemini, OpenAI, Mistral, or OpenRouter keys once in Settings and choose a provider per workflow." },
  { step: "02", title: "Drop a batch", text: "Upload images, SVGs, or a market brief. The workspace keeps your queue, settings, and outputs together." },
  { step: "03", title: "Export the finished work", text: "Download metadata CSVs, prompt packs, transparent PNGs, SVG charts, GLB files, or turntable video." },
];

const tools = [
  { icon: WandSparkles, label: "01 / AI metadata", title: "Turn images into publishable listings", text: "Generate titles, descriptions, categories, keywords, and prompts with provider-aware controls and batch processing.", href: "/dashboard/generator" },
  { icon: Box, label: "02 / 3D icon studio", title: "Build the hero asset", text: "Shape SVGs into Liquid Glass, Plastic, or Metal icons, tune bevels and lighting, then export PNG, GLB, OBJ, or MP4.", href: "/dashboard/3d-icon-studio" },
  { icon: Eraser, label: "03 / Background remover", title: "Deliver transparent assets", text: "Remove image backgrounds in a bulk queue and download clean PNG results for your next listing or composition.", href: "/dashboard/bg-remover" },
  { icon: Grid3X3, label: "04 / Grid + Bento", title: "Compose the visual system", text: "Create Fibonacci, Golden Ratio, isometric, and bento layouts with presets, widgets, and SVG export.", href: "/dashboard/grid-generator" },
  { icon: Palette, label: "05 / Palette studio", title: "Extract a usable color language", text: "Pull colors from an image, refine the palette, and copy CSS variables or download JSON and SVG swatches.", href: "/dashboard/palette" },
  { icon: BarChart3, label: "06 / Trading studio", title: "Make data-ready visuals", text: "Build candlestick charts with indicators, templates, favorites, realtime market data, and SVG or PNG export.", href: "/dashboard/trading" },
];

const supportingTools = [
  [Type, "Typebox", "Kinetic type, 3D distortions, and glass lettering"],
  [CalendarDays, "Events", "2026 event ideas and exportable content planning"],
  [TerminalSquare, "ASCII vision", "Turn images into configurable ASCII compositions"],
  [Layers3, "CSV + downloads", "Keep generated files and export history organized"],
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-background pb-20 text-foreground transition-colors duration-300 selection:bg-primary selection:text-white lg:pb-0">
      <MarketingChrome activePath="/" />

      <section className="relative mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-7xl flex-col justify-center px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute left-1/2 top-24 h-[34rem] w-[52rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(22,199,132,0.18),transparent_66%)] blur-3xl" />
        <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <div>
            <h1 className="mt-7 max-w-4xl text-4xl font-black leading-[1.03] tracking-[-0.04em] text-foreground sm:text-6xl lg:text-7xl">
              From upload to <span className="text-primary">publishable asset.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground/70 sm:text-lg">
              MCUSTOCK brings metadata, prompts, 3D icons, transparent PNGs, layouts, palettes, typography, charts, and content planning into one focused creator workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard/generator" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(22,199,132,0.3)] transition-transform hover:-translate-y-1 active:scale-95">
                <Zap className="h-4 w-4" /> Open the workspace <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/docs" className="inline-flex items-center justify-center gap-2 rounded-full border border-foreground/15 bg-foreground/[0.03] px-6 py-3.5 text-sm font-bold transition-colors hover:border-primary hover:text-primary">
                <TerminalSquare className="h-4 w-4 text-primary" /> Read the workflow docs
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-foreground/55">
              {["Multi-provider AI", "Batch queues", "CSV + ZIP exports", "No vendor lock-in"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" />{item}</span>
              ))}
            </div>
          </div>

          <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-2xl backdrop-blur-[24px] [-webkit-backdrop-filter:blur(24px)] sm:p-6">
            <div className="rounded-[1.5rem] border border-foreground/10 bg-background/70 p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-foreground/10 pb-4">
                <div className="flex items-center gap-2 text-sm font-bold text-primary"><ImagePlus className="h-4 w-4" /> Workspace queue</div>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">Ready to export</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[ ["12", "Images queued"], ["4", "Tools in flow"], ["49", "Keywords / asset"], ["8K", "3D output"] ].map(([value, label]) => <div key={label} className="rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-4"><p className="text-2xl font-black text-foreground">{value}</p><p className="mt-1 text-xs font-semibold text-foreground/50">{label}</p></div>)}
              </div>
              <div className="mt-4 space-y-2 rounded-2xl border border-primary/15 bg-primary/[0.05] p-4">
                <div className="flex items-center justify-between text-xs font-bold"><span className="text-foreground/70">metadata-batch.csv</span><span className="text-primary">Complete</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-foreground/10"><div className="h-full w-[92%] rounded-full bg-primary" /></div>
                <div className="flex items-center justify-between text-[10px] font-semibold text-foreground/45"><span>Generator + Palette + Grid</span><span>92%</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-foreground/[0.07] bg-foreground/[0.018]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl"><p className="text-sm font-semibold text-primary">The full toolkit</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Every step after the upload.</h2><p className="mt-4 text-sm leading-relaxed text-foreground/65">Use one tool or connect several. Each surface is built for a repeated creator workflow, not a one-off demo.</p></div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            {tools.map(({ icon: Icon, label, title, text, href }, index) => <Link key={title} href={href} className={`group relative overflow-hidden border border-foreground/[0.1] bg-background/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:bg-primary/[0.035] hover:shadow-[0_18px_50px_rgba(22,199,132,0.12)] ${index === 0 ? "lg:col-span-4 lg:row-span-2 lg:p-8" : "lg:col-span-2"}`}><div className="absolute right-5 top-5 text-5xl font-black tracking-[-0.08em] text-foreground/[0.045]">{String(index + 1).padStart(2, "0")}</div><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.08] text-primary transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105"><Icon className="h-5 w-5" /></div><p className="mt-8 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{label}</p><h3 className={`${index === 0 ? "mt-3 text-2xl sm:text-3xl" : "mt-2 text-lg"} font-extrabold tracking-tight`}>{title}</h3><p className={`${index === 0 ? "mt-4 max-w-xl text-base" : "mt-3 text-sm"} leading-relaxed text-foreground/62`}>{text}</p><span className="mt-7 inline-flex items-center gap-2 text-xs font-bold text-foreground/65 transition-colors group-hover:text-primary">Open tool <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span></Link>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start"><div><p className="text-sm font-semibold text-primary">Also in the workspace</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Small tools that finish the job.</h2><p className="mt-4 text-sm leading-relaxed text-foreground/65">When the main asset is ready, these focused surfaces help you package, plan, and polish it.</p></div><div className="grid gap-3 sm:grid-cols-2">{supportingTools.map(([Icon, title, text]) => <div key={title as string} className="group flex gap-3 border-b border-foreground/[0.1] py-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.08] text-primary transition-transform group-hover:-rotate-6"><Icon className="h-4 w-4" /></span><div><h3 className="text-sm font-extrabold">{title as string}</h3><p className="mt-1 text-xs leading-relaxed text-foreground/60">{text as string}</p></div></div>)}</div></div>
      </section>

      <section className="border-y border-foreground/[0.07] bg-primary/[0.045]"><div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-semibold text-primary">A repeatable workflow</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Make the process feel lighter.</h2></div><div className="mt-12 grid gap-5 md:grid-cols-3">{workflow.map((item) => <div key={item.step} className="border-l-2 border-primary/30 pl-5"><span className="text-4xl font-black text-primary/30">{item.step}</span><h3 className="mt-3 text-lg font-extrabold">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-foreground/65">{item.text}</p></div>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="overflow-hidden rounded-[2rem] border border-primary/25 bg-primary/10 p-8 text-center shadow-2xl sm:p-14"><p className="text-sm font-semibold text-primary">Built for the whole asset lifecycle</p><h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">Start with one image. Leave with a complete package.</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-foreground/70">Generate the listing, clean the background, choose the palette, compose the layout, and export the formats your library actually needs.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-white transition-transform hover:-translate-y-1"><Sparkles className="h-4 w-4" /> Create your workspace <ArrowRight className="h-4 w-4" /></Link><Link href="/pricing" className="inline-flex items-center justify-center gap-2 rounded-full border border-foreground/20 bg-background/50 px-7 py-3.5 text-sm font-bold hover:border-primary hover:text-primary">Compare plans</Link></div></div></section>

      <footer className="border-t border-foreground/[0.08] px-4 py-10 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-5 text-xs text-foreground/55 sm:flex-row sm:items-center sm:justify-between"><p>MCUSTOCK AI · A practical workspace for stock, 3D, and visual creators.</p><div className="flex flex-wrap gap-4 font-bold"><Link href="/docs" className="hover:text-primary">Docs</Link><Link href="/pricing" className="hover:text-primary">Pricing</Link><Link href="/dashboard/generator" className="hover:text-primary">Open workspace</Link></div></div></footer>
+    </main>
  );
}
