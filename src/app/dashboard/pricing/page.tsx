"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import {
  Check,
  Crown,
  Sparkles,
  Star,
  Zap,
  Shield,
  ArrowRight,
  HelpCircle,
  Layers,
  ChevronDown,
  Box,
  Eraser,
  BarChart3,
  Activity,
  Type,
  Grid3X3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type PlanTier = {
  id: string;
  name: string;
  badge?: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
  color: string;
};

const PLANS: PlanTier[] = [
  {
    id: "free",
    name: "Free Starter",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Essential tools for beginner stock contributors and hobbyists.",
    features: [
      "50 AI metadata generations / month",
      "Standard Background Remover (1K)",
      "3D Icon Studio Basic Export",
      "TODOTOOL Typebox 10 presets",
      "Live Trading Charts (Standard feed)",
      "Smart Grid basic compositions",
      "Community support",
    ],
    cta: "Current Plan",
    color: "#a1a1aa",
  },
  {
    id: "pro",
    name: "Pro Creator",
    badge: "MOST POPULAR",
    popular: true,
    monthlyPrice: 19,
    annualPrice: 15,
    description: "Uncapped power for professional stock artists, 3D designers, and agencies.",
    features: [
      "Unlimited AI metadata & SEO generation",
      "Batch Image Generation (500+ items at once)",
      "HD Background Remover (Full 4K alpha)",
      "3D Icon Studio PRO (RoomEnvironment IBL + 4K)",
      "TODOTOOL Graphic Engine (All 6 visual FX)",
      "Live Trading Studio (Real-time Binance WebSocket)",
      "Smart Grid (Logarithmic Fibonacci & Golden Phi)",
      "Adobe Analytics Market Research tool",
      "Commercial Vector SVG & WebP Exports",
      "Priority API speed & Groq/Gemini models",
    ],
    cta: "Upgrade to Pro",
    color: "#16c784",
  },
  {
    id: "agency",
    name: "Studio Agency",
    badge: "MAX PERFORMANCE",
    monthlyPrice: 49,
    annualPrice: 39,
    description: "High-volume throughput, custom API keys, and dedicated team workflows.",
    features: [
      "Everything in Pro Creator included",
      "5 Team Member Seats included",
      "Dedicated Custom AI API key endpoints",
      "Ultra-Fast Concurrency (20 parallel requests)",
      "Custom CSV Export Templates for all microstock sites",
      "Automated Stock Metadata Bulk Sync",
      "Early beta access to new Studio AI tools",
      "24/7 Dedicated Account Manager & VIP Support",
    ],
    cta: "Get Agency Access",
    color: "#38bdf8",
  },
];

const COMPARISON_FEATURES = [
  { category: "AI Metadata & Stock Tools", items: [
    { name: "Monthly Metadata Generation", free: "50 images", pro: "Unlimited", agency: "Unlimited" },
    { name: "Batch CSV Exports (Adobe / Shutterstock)", free: "Basic", pro: "All Platforms", agency: "Custom Templates" },
    { name: "Bulk Concurrency Speed", free: "1x", pro: "5x Parallel", agency: "20x Turbo" },
    { name: "AI Prompt Generator", free: "Standard", pro: "Advanced Parameters", agency: "Custom Presets" },
  ]},
  { category: "Creative Studios & 3D", items: [
    { name: "3D Icon Studio PRO (Liquid Glass / Plastic)", free: "Standard 1K", pro: "4K High-Res + PMREM IBL", agency: "4K + Batch Export" },
    { name: "TODOTOOL Typebox Studio (Dither, Slice, Boom)", free: "1K Preview", pro: "4K Vector SVG & PNG", agency: "Custom Shards & Fonts" },
    { name: "Smart Grid Composition Lab", free: "Basic Grids", pro: "Golden Phi & Fibonacci Arcs", agency: "Full Vector Suite" },
    { name: "Background Remover", free: "1K Standard", pro: "4K Clean Alpha Matting", agency: "Batch Processing" },
    { name: "Live Trading Studio", free: "Standard Feed", pro: "Multi-Style Vector SVG", agency: "All Indicators + Realtime" },
  ]},
  { category: "Support & Infrastructure", items: [
    { name: "Custom API Keys (Groq / Gemini / OpenAI)", free: "Yes", pro: "Yes (Encrypted)", agency: "Yes + Team Sharing" },
    { name: "Support SLA", free: "Community", pro: "Priority Email (24h)", agency: "Dedicated 24/7 VIP" },
  ]},
];

const FAQS = [
  {
    q: "Can I cancel or switch plans anytime?",
    a: "Yes, you can upgrade, downgrade, or cancel your subscription at any time with zero penalty. If you cancel, your Pro features remain active until the end of the billing cycle.",
  },
  {
    q: "How does the annual discount work?",
    a: "When billed annually, you save 20% on your subscription—equivalent to getting over 2 months completely free every year.",
  },
  {
    q: "Can I use my own AI API keys?",
    a: "Yes! MCUSTOCK AI allows you to plug in your own free or paid API keys from Groq, Google Gemini, OpenAI, Mistral AI, and OpenRouter without any restrictions.",
  },
  {
    q: "What payment methods are supported?",
    a: "We accept all major international credit/debit cards (Visa, Mastercard, American Express), Apple Pay, Google Pay, and localized bank transfers.",
  },
];

export default function DashboardPricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex(openFaqIndex === idx ? null : idx);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-12 pb-20 pt-2 font-sans">
        {/* Header Hero Banner */}
        <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest shadow-sm">
            <Crown className="h-4 w-4" /> Transparent Subscription Plans
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
            Supercharge Your Stock Portfolio with <span className="text-primary">MCUSTOCK AI</span>
          </h1>
          <p className="text-sm sm:text-base text-foreground/60 leading-relaxed font-medium">
            Unlock unlimited AI metadata, 4K 3D Icon Studio exports, vector trading charts, and high-throughput batch tools.
          </p>

          {/* Monthly / Annual Billing Toggle */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <span className={`text-xs font-bold ${billingCycle === "monthly" ? "text-primary font-extrabold" : "text-foreground/60"}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle((prev) => (prev === "monthly" ? "annual" : "monthly"))}
              className="relative h-8 w-16 rounded-full bg-foreground/15 p-1 transition-colors border border-foreground/10 focus:outline-none"
              aria-label="Toggle Billing Cycle"
            >
              <motion.div
                animate={{ x: billingCycle === "annual" ? 30 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="h-6 w-6 rounded-full bg-primary shadow-md flex items-center justify-center text-background text-[10px] font-bold"
              />
            </button>
            <span className={`text-xs font-bold flex items-center gap-1.5 ${billingCycle === "annual" ? "text-primary font-extrabold" : "text-foreground/60"}`}>
              Annual <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/20 text-primary border border-primary/30">SAVE 20%</span>
            </span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan) => {
            const price = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl border p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
                  plan.popular
                    ? "border-primary bg-primary/[0.04] shadow-[0_0_35px_rgba(22,199,132,0.18)] scale-[1.02] ring-1 ring-primary/40"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-primary/40 shadow-xl"
                }`}
              >
                {/* Popular Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-background font-black text-[10px] tracking-widest uppercase shadow-md flex items-center gap-1.5">
                    <Star className="h-3 w-3 fill-current" /> {plan.badge}
                  </div>
                )}

                <div className="space-y-6">
                  {/* Plan Name & Desc */}
                  <div>
                    <h2 className="text-xl font-black text-foreground">{plan.name}</h2>
                    <p className="mt-1.5 text-xs text-foreground/60 min-h-[36px]">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-1.5 pt-2 border-t border-foreground/10">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
                      ${price}
                    </span>
                    <span className="text-xs font-bold text-foreground/50">
                      / month {billingCycle === "annual" && price > 0 && "(billed yearly)"}
                    </span>
                  </div>

                  {/* CTA Button */}
                  <Link
                    href={plan.id === "free" ? "/dashboard/generator" : `/dashboard/settings?upgrade=${plan.id}`}
                    className={`w-full py-3 px-4 rounded-2xl text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-2 ${
                      plan.popular
                        ? "bg-primary text-background hover:bg-primary-hover shadow-lg shadow-primary/25 active:scale-[0.98]"
                        : "border border-primary/30 text-primary hover:bg-primary/10"
                    }`}
                  >
                    {plan.cta} <ArrowRight className="h-4 w-4" />
                  </Link>

                  {/* Feature Checklist */}
                  <div className="space-y-3 pt-4 border-t border-foreground/10">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary/70 block">
                      Included Features:
                    </span>
                    {plan.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs font-medium text-foreground/80">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5 stroke-[2.5]" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 text-center text-[11px] text-foreground/40 font-medium">
                  {plan.id === "free" ? "No credit card required" : "14-day money-back guarantee"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center justify-center gap-2">
              <Layers className="h-5 w-5 text-primary" /> Detailed Feature Comparison
            </h2>
            <p className="text-xs text-foreground/50">Compare tools, limits, and capabilities across all tiers.</p>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-foreground/10 text-foreground/60 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Feature / Capability</th>
                  <th className="py-3 px-4 text-center">Free Starter</th>
                  <th className="py-3 px-4 text-center text-primary font-black">Pro Creator</th>
                  <th className="py-3 px-4 text-center">Studio Agency</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((cat, ci) => (
                  <Fragment key={ci}>
                    <tr>
                      <td colSpan={4} className="pt-5 pb-2 px-4 font-black text-primary text-xs uppercase tracking-widest bg-foreground/[0.02]">
                        {cat.category}
                      </td>
                    </tr>
                    {cat.items.map((item, ii) => (
                      <tr key={ii} className="border-b border-foreground/5 hover:bg-foreground/[0.02] transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground/80">{item.name}</td>
                        <td className="py-3 px-4 text-center font-bold text-foreground/60">{item.free}</td>
                        <td className="py-3 px-4 text-center font-bold text-primary">{item.pro}</td>
                        <td className="py-3 px-4 text-center font-bold text-foreground/90">{item.agency}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Accordion */}
        <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center justify-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" /> Frequently Asked Questions
            </h2>
            <p className="text-xs text-foreground/50">Everything you need to know about plans and billing.</p>
          </div>

          <div className="space-y-3 max-w-3xl mx-auto">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-4 text-left font-bold text-xs sm:text-sm flex items-center justify-between gap-4 text-foreground hover:text-primary transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180 text-primary" : "text-foreground/40"}`} />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-4 pb-4 text-xs text-foreground/70 leading-relaxed border-t border-foreground/5 pt-2"
                      >
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
    </div>
  );
}
