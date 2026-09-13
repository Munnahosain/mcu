"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  WandSparkles,
  Zap,
  Box,
  Layers,
  Palette,
  Type,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import MarketingChrome from "@/components/MarketingChrome";

const PLATFORMS = [
  "Adobe Stock",
  "Shutterstock",
  "Freepik",
  "Vecteezy",
  "Pond5",
  "Envato Elements",
  "Getty Images",
  "iStock",
];

const FEATURES = [
  {
    icon: WandSparkles,
    badge: "AI Workflow",
    title: "Stock Metadata & Prompt Generator",
    desc: "Extract SEO-optimized titles, categories, descriptions, and 50+ comma-separated keywords with multi-platform compliance.",
    href: "/dashboard/generator",
    tag: "Multi-Model AI",
  },
  {
    icon: Box,
    badge: "3D Studio",
    title: "Photorealistic 3D Icon Studio",
    desc: "Convert SVG vectors into realistic 3D Liquid Glass, Plastic, and Metal models with 360° MP4 Turntable video, GLB, and 8K export.",
    href: "/dashboard/3d-icon-studio",
    tag: "Ultra-HD & MP4",
  },
  {
    icon: Layers,
    badge: "Canvas Suite",
    title: "Smart Grid & Bento Builder",
    desc: "Design Fibonacci, Golden Ratio, and isometric layouts with live drag-and-drop grid customization and SVG export.",
    href: "/dashboard/bento",
    tag: "Vector Grid",
  },
  {
    icon: Palette,
    badge: "Color Engine",
    title: "Color Palette & Eyedropper Studio",
    desc: "Extract harmonious color palettes from imagery with 1-click CSS Variables, JSON, and SVG swatch downloads.",
    href: "/dashboard/palette",
    tag: "CSS & JSON",
  },
  {
    icon: Type,
    badge: "Typography",
    title: "Typebox Studio",
    desc: "Generate kinetic typography, 3D text distortions, and glass lettering effects with scalable vector rendering.",
    href: "/dashboard/typebox",
    tag: "Kinetic Type",
  },
  {
    icon: TrendingUp,
    badge: "Financial Vector",
    title: "Live Trading Candlestick Charts",
    desc: "Generate clean SVG/PNG trading charts, volume indicators, and technical stock visuals for stock portfolios.",
    href: "/dashboard/trading",
    tag: "Realtime Vector",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-300 selection:bg-primary selection:text-white">
      <MarketingChrome activePath="/" />

      {/* 2. HERO SECTION */}
      <section className="relative mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-7xl flex-col items-center justify-center px-4 pb-16 pt-12 text-center sm:px-6 lg:px-8">
        {/* Subtle Ambient Radial Glow */}
        <div className="pointer-events-none absolute left-1/2 top-16 h-[36rem] w-[50rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(22,199,132,0.16),transparent_65%)] blur-3xl" />

        {/* Top Badge */}
        <div className="relative inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>MCUSTOCK 2.0 • AI Multi-Provider Stock Suite & 3D Studio</span>
        </div>

        {/* Main Headline */}
        <h1 className="relative mt-8 max-w-5xl text-4xl font-black leading-[1.08] tracking-[-0.04em] text-foreground sm:text-6xl lg:text-7xl">
          Turn every upload into <span className="text-primary">stock-ready</span> assets & 3D models.
        </h1>

        {/* Subtitle */}
        <p className="relative mt-6 max-w-2xl text-sm leading-relaxed text-foreground/70 sm:text-base lg:text-lg">
          Generate SEO titles, descriptions, keyword tags, prompt recipes, CSV batch exports, and photorealistic 3D icons from one unified workspace built for creators.
        </p>

        {/* Hero CTA Buttons */}
        <div className="relative mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/dashboard/generator"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(22,199,132,0.35)] transition-all duration-200 hover:-translate-y-1 hover:bg-primary-hover active:scale-95"
          >
            <Zap className="h-4 w-4" />
            <span>Start Free Generator</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/dashboard/3d-icon-studio"
            className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/[0.03] px-7 py-3.5 text-sm font-bold text-foreground transition-all duration-200 hover:border-primary hover:text-primary hover:bg-primary/5 active:scale-95"
          >
            <Box className="h-4 w-4 text-primary" />
            <span>Launch 3D Icon Studio</span>
          </Link>
        </div>

        {/* Live Metrics Row */}
        <div className="relative mt-12 grid grid-cols-2 gap-4 rounded-3xl border border-foreground/[0.08] bg-foreground/[0.02] p-4 text-left backdrop-blur-md sm:grid-cols-4 sm:p-6 w-full max-w-4xl">
          <div className="border-r border-foreground/[0.08] pr-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">Batch Processing</p>
            <p className="mt-1 text-2xl font-extrabold text-foreground">500+ Assets</p>
            <p className="text-[11px] text-primary font-semibold">1-Click CSV & ZIP</p>
          </div>
          <div className="border-r border-foreground/[0.08] pr-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">AI Providers</p>
            <p className="mt-1 text-2xl font-extrabold text-foreground">Gemini & GPT</p>
            <p className="text-[11px] text-primary font-semibold">Groq, Mistral, OpenRouter</p>
          </div>
          <div className="border-r border-foreground/[0.08] pr-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">3D Output</p>
            <p className="mt-1 text-2xl font-extrabold text-foreground">8K & 360° MP4</p>
            <p className="text-[11px] text-primary font-semibold">GLB & OBJ Wavefront</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">Accuracy</p>
            <p className="mt-1 text-2xl font-extrabold text-foreground">99.4% SEO</p>
            <p className="text-[11px] text-primary font-semibold">Multi-Platform Matched</p>
          </div>
        </div>

        {/* Supported Platforms Marquee Bar */}
        <div className="relative mt-16 w-full max-w-4xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-foreground/45 mb-4">
            Directly Compatible With All Major Stock Agencies
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {PLATFORMS.map((platform) => (
              <span
                key={platform}
                className="rounded-full border border-foreground/[0.08] bg-foreground/[0.02] px-4 py-1.5 text-xs font-bold text-foreground/75"
              >
                {platform}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 3. BENTO GRID FEATURE SHOWCASE */}
      <section className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 border-t border-foreground/[0.06]">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-primary">
            Comprehensive Creator Suite
          </span>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-5xl">
            Everything you need from upload to export.
          </h2>
          <p className="mt-3 text-sm text-foreground/65">
            Crafted for individual contributors, stock agencies, and generative 3D artists.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className="group relative flex flex-col justify-between rounded-3xl border border-foreground/[0.08] bg-foreground/[0.02] p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-xl"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 transition-transform duration-300 group-hover:scale-110">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-extrabold text-primary">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-foreground/65">{item.desc}</p>
                </div>

                <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-primary">
                  <span>Open Tool</span>
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 4. HOW IT WORKS WORKFLOW */}
      <section className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 border-t border-foreground/[0.06]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-primary">
            Fast & Painless Workflow
          </span>
          <h2 className="mt-2 text-3xl font-black text-foreground sm:text-4xl">How MCUSTOCK Works</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Drop Your Files",
              desc: "Upload up to 500 photos, vectors, or SVGs into your workspace queue simultaneously.",
            },
            {
              step: "02",
              title: "AI Analysis & 3D Extrusion",
              desc: "Multi-model AI extracts high-converting metadata while the 3D engine generates smoothed models.",
            },
            {
              step: "03",
              title: "Download & Publish",
              desc: "Export platform-ready CSVs, 8K PNGs, 360° MP4 videos, or 3D GLB models in one click.",
            },
          ].map((s) => (
            <div
              key={s.step}
              className="rounded-3xl border border-foreground/[0.08] bg-foreground/[0.02] p-8 relative overflow-hidden"
            >
              <span className="text-5xl font-black text-primary/20 block mb-4">{s.step}</span>
              <h3 className="text-base font-extrabold text-foreground">{s.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-foreground/65">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. CALL TO ACTION (CTA) */}
      <section className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[32px] border border-primary/30 bg-primary/10 p-8 sm:p-14 text-center shadow-2xl backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />

          <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-5xl">
            Ready to accelerate your stock & 3D workflow?
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-sm text-foreground/75 leading-relaxed">
            Join creators who use MCUSTOCK to process upload queues faster and produce photorealistic 3D assets.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard/generator"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-1 hover:bg-primary-hover active:scale-95"
            >
              <Zap className="h-4 w-4" />
              <span>Launch Studio Now</span>
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-background/50 px-7 py-3.5 text-sm font-bold text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <span>View Pricing Plans</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 6. FOOTER */}
      <footer className="border-t border-foreground/[0.08] bg-background px-4 py-12 sm:px-6 lg:px-8 text-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Image src="/MCU-LOGO-0.2V-1.png" alt="MCUSTOCK" width={20} height={20} className="h-5 w-5 object-contain" />
            </span>
            <span className="text-sm font-black text-foreground">MCUSTOCK AI</span>
          </div>
          <p className="text-xs font-medium text-foreground/50">
            © {new Date().getFullYear()} MCUSTOCK. All rights reserved. Built for stock creators.
          </p>
          <div className="flex gap-4 text-xs font-bold text-foreground/70">
            <Link href="/dashboard/generator" className="hover:text-primary transition-colors">
              Generator
            </Link>
            <Link href="/dashboard/3d-icon-studio" className="hover:text-primary transition-colors">
              3D Studio
            </Link>
            <Link href="/pricing" className="hover:text-primary transition-colors">
              Pricing
            </Link>
            <Link href="/docs" className="hover:text-primary transition-colors">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}