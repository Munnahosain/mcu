"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import { ArrowRight, Check, Star, Layers, HelpCircle, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MarketingChrome from "../../components/MarketingChrome";
import MarketingFooter from "../../components/MarketingFooter";
import SegmentedToggle from "@/components/ui/SegmentedToggle";

const tiers = [
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
    cta: "Start Free",
    ctaLink: "/signup",
    popular: false,
    icon: "Tier 01",
  },
  {
    id: "pro",
    name: "Pro Creator",
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
    cta: "Get Pro Access",
    ctaLink: "/signup?plan=pro",
    popular: true,
    icon: "Tier 02",
  },
  {
    id: "agency",
    name: "Studio Agency",
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
    cta: "Contact Sales",
    ctaLink: "/signup?plan=agency",
    popular: false,
    icon: "Tier 03",
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

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex(openFaqIndex === idx ? null : idx);
  };

  return (
    <div className="liquid-page-shell min-h-screen pt-28 bg-background text-foreground">
      <MarketingChrome activePath="/pricing" />
      <main className="mx-auto max-w-7xl space-y-16 px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <h1 className="liquid-title text-4xl font-extrabold tracking-tight md:text-6xl text-foreground">
            Simple, Transparent Pricing
          </h1>
          <p className="liquid-copy text-base md:text-lg text-foreground/70 max-w-2xl mx-auto">
            Choose the plan that matches your portfolio scale. No hidden fees, just seamless AI workflows and ultra high-res exports.
          </p>

          {/* Monthly / Annual Billing Toggle */}
          <div className="pt-2 flex items-center justify-center">
            <SegmentedToggle<"monthly" | "annual">
              options={[
                { id: "monthly", label: "Monthly" },
                {
                  id: "annual",
                  label: "Annual",
                },
              ]}
              value={billingCycle}
              onChange={(val) => setBillingCycle(val)}
              size="md"
              className="w-auto min-w-[260px]"
              ariaLabel="Billing cycle selection"
            />
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 pt-4 md:grid-cols-3 items-stretch">
          {tiers.map((tier) => {
            const price = billingCycle === "annual" ? tier.annualPrice : tier.monthlyPrice;
            return (
              <div
                key={tier.name}
                className={`liquid-card border rounded-3xl relative flex flex-col justify-between overflow-hidden p-8 transition-all duration-300 ${
                  tier.popular
                    ? "z-10 md:scale-105 border-primary bg-primary/[0.04] shadow-[0_0_35px_rgba(22,199,132,0.18)] ring-1 ring-primary/40"
                    : "border-foreground/10 bg-foreground/[0.02] hover:border-primary/40 shadow-xl"
                }`}
              >
                {tier.popular ? (
                  <div className="absolute left-1/2 top-0 flex -translate-x-1/2 items-center gap-2 rounded-b-xl bg-primary px-4 py-1.5 text-xs font-bold text-background shadow-lg">
                    <Star className="h-4 w-4 fill-current" />
                    Most popular
                  </div>
                ) : null}

                <div>
                  <div className="mb-6 flex items-start justify-between gap-4 pt-2">
                    <div>
                      <h2 className="liquid-title mb-2 text-2xl font-black text-foreground">
                        {tier.name}
                      </h2>
                      <p className="liquid-copy text-xs text-foreground/60 min-h-[32px]">{tier.description}</p>
                    </div>
                    <span className="rounded-xl border border-primary/20 flex items-center justify-center bg-primary/10 text-primary px-3 py-1.5 text-[10px] font-semibold shrink-0">
                      {tier.icon.replace("Tier", "Plan")}
                    </span>
                  </div>

                  <div className="h-px bg-foreground/10 my-4" />

                  <div className="my-6 flex items-baseline gap-2 text-foreground">
                    <span className="liquid-title text-5xl font-black tracking-tight">
                      ${price}
                    </span>
                    <span className="liquid-copy text-xs font-bold text-foreground/50">
                      / month {billingCycle === "annual" && price > 0 && "(billed yearly)"}
                    </span>
                  </div>

                  <Link
                    href={tier.ctaLink}
                    className={`w-full px-4 py-3 rounded-2xl text-xs font-bold transition-all text-center flex items-center justify-center gap-2 ${
                      tier.popular
                        ? "bg-primary text-background hover:bg-primary-hover shadow-lg shadow-primary/25 active:scale-[0.98]"
                        : "border border-primary/30 text-primary hover:bg-primary/10"
                    }`}
                  >
                    {tier.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <div className="mt-8 space-y-3">
                    <p className="text-[11px] font-semibold text-primary/70">
                      What&apos;s included
                    </p>
                    {tier.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2.5 text-xs font-medium text-foreground/80">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5 stroke-[2.5]" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 text-center text-[11px] text-foreground/40 font-medium">
                  {tier.id === "free" ? "No credit card required" : "14-day money-back guarantee"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="mx-auto max-w-6xl rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center justify-center gap-2">
              <Layers className="h-5 w-5 text-primary" /> Detailed Feature Comparison
            </h2>
            <p className="text-xs text-foreground/50">Compare tools, limits, and capabilities across all tiers.</p>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-foreground/10 text-foreground/60 font-semibold text-[11px]">
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
                      <td colSpan={4} className="pt-5 pb-2 px-4 font-bold text-primary text-xs bg-foreground/[0.02]">
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
        <div className="mx-auto max-w-4xl rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-6 sm:p-8 space-y-6 shadow-xl">
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
      </main>
      <MarketingFooter />
    </div>
  );
}
