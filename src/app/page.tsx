"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles, WandSparkles, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#101114] text-white">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white text-black shadow-xl">
            <Image src="/MCU-LOGO-0.2V-1.png" alt="MCUSTOCK" width={26} height={26} className="h-6 w-6 object-contain" />
          </span>
          <span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.28em] text-white/45">AI stock workflow</span>
            <span className="text-lg font-bold tracking-tight">MCUSTOCK</span>
          </span>
        </Link>
        <Link href="/dashboard/generator" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition-transform hover:-translate-y-0.5">
          Open App <ArrowRight className="h-4 w-4" />
        </Link>
      </nav>

      <section className="relative mx-auto flex min-h-[calc(100vh-92px)] w-full max-w-7xl flex-col items-center px-6 pb-20 pt-20 text-center lg:px-10 lg:pt-28">
        <div className="pointer-events-none absolute left-1/2 top-24 h-[34rem] w-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(36,202,144,0.14),transparent_68%)] blur-3xl" />
        <div className="relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/55">
          <Sparkles className="h-3.5 w-3.5 text-[#24ca90]" /> AI-powered stock metadata generation
        </div>
        <h1 className="relative mt-8 max-w-5xl text-5xl font-black leading-[0.98] tracking-[-0.04em] sm:text-7xl lg:text-8xl">
          Turn every upload into <span className="text-[#24ca90]">stock-ready</span> content.
        </h1>
        <p className="relative mt-7 max-w-2xl text-base leading-7 text-white/50 sm:text-lg">
          Generate titles, descriptions, keywords, prompts, and CSV exports from one focused workspace built for stock creators.
        </p>
        <div className="relative mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/dashboard/generator" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-black shadow-[0_14px_40px_rgba(255,255,255,0.12)] transition-transform hover:-translate-y-1">
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/dashboard/generator" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-7 py-3.5 text-sm font-bold text-white/75 transition-colors hover:border-[#24ca90]/50 hover:text-white">
            <WandSparkles className="h-4 w-4 text-[#24ca90]" /> Explore workspace
          </Link>
        </div>

        <div className="relative mt-20 grid w-full max-w-4xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
          {[
            [Zap, "Fast generation", "Process a full upload queue with your active AI provider."],
            [WandSparkles, "Creator controls", "Tune title length, keyword count, and export platform."],
            [Sparkles, "Clean exports", "Copy individual fields or download a ready CSV."],
          ].map(([Icon, title, text]) => {
            const FeatureIcon = Icon as typeof Zap;
            return <div key={title as string} className="border-t border-white/10 px-2 pt-5 sm:px-5">
              <FeatureIcon className="h-5 w-5 text-[#24ca90]" />
              <h2 className="mt-4 text-sm font-bold">{title as string}</h2>
              <p className="mt-2 text-xs leading-5 text-white/40">{text as string}</p>
            </div>;
          })}
        </div>
      </section>
    </main>
  );
}