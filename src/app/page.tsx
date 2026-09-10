"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles, WandSparkles, Zap } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground transition-colors duration-200">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-foreground/[0.04] text-foreground shadow-sm">
            <Image src="/MCU-LOGO-0.2V-1.png" alt="MCUSTOCK" width={26} height={26} className="h-6 w-6 object-contain" />
          </span>
          <span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.28em] text-foreground/50">AI stock workflow</span>
            <span className="text-lg font-bold tracking-tight text-primary">MCUSTOCK</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle iconOnly />
          <Link
            href="/dashboard/generator"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(22,199,132,0.3)] transition-transform hover:-translate-y-0.5 hover:bg-primary-hover"
          >
            Open App <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      <section className="relative mx-auto flex min-h-[calc(100vh-92px)] w-full max-w-7xl flex-col items-center px-6 pb-20 pt-20 text-center lg:px-10 lg:pt-28">
        <div className="pointer-events-none absolute left-1/2 top-24 h-[34rem] w-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(22,199,132,0.14),transparent_68%)] blur-3xl" />
        <div className="relative inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-xs font-bold text-primary">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> AI-powered stock metadata generation
        </div>
        <h1 className="relative mt-8 max-w-5xl text-5xl font-black leading-[1.05] tracking-[-0.04em] text-foreground sm:text-7xl lg:text-8xl">
          Turn every upload into <span className="text-primary">stock-ready</span> content.
        </h1>
        <p className="relative mt-7 max-w-2xl text-base leading-7 text-foreground/65 sm:text-lg">
          Generate titles, descriptions, keywords, prompts, and CSV exports from one focused workspace built for stock creators.
        </p>
        <div className="relative mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/dashboard/generator"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(22,199,132,0.35)] transition-transform hover:-translate-y-1 hover:bg-primary-hover"
          >
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard/generator"
            className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/[0.03] px-7 py-3.5 text-sm font-bold text-foreground/85 transition-colors hover:border-primary hover:text-primary"
          >
            <WandSparkles className="h-4 w-4 text-primary" /> Explore workspace
          </Link>
        </div>

        <div className="relative mt-20 grid w-full max-w-4xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
          {[
            [Zap, "Fast generation", "Process a full upload queue with your active AI provider."],
            [WandSparkles, "Creator controls", "Tune title length, keyword count, and export platform."],
            [Sparkles, "Clean exports", "Copy individual fields or download a ready CSV."],
          ].map(([Icon, title, text]) => {
            const FeatureIcon = Icon as typeof Zap;
            return (
              <div key={title as string} className="border-t border-foreground/10 px-2 pt-5 sm:px-5">
                <FeatureIcon className="h-5 w-5 text-primary" />
                <h2 className="mt-4 text-sm font-bold text-foreground">{title as string}</h2>
                <p className="mt-2 text-xs leading-5 text-foreground/60">{text as string}</p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}